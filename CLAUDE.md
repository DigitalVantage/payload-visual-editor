# @digitalvantage/payload-visual-editor

Open-source inline visual editor plugin for Payload CMS 3.x (target `payload@^3.85`): browse the site in Live Preview, toggle edit mode, hover-highlight marked regions, click to edit fields with native Payload UI, and add/duplicate/remove/drag-reorder blocks on the page.

`README.md` documents the public API and integration recipes; `RELEASING.md` has the publish checklist.

## Workspace map (pnpm monorepo)

| Path | Package | Role |
|---|---|---|
| `packages/plugin` | `@digitalvantage/payload-visual-editor` | Payload plugin: config mutation + admin-side controller (injected via `edit.beforeDocumentControls`) |
| `packages/core` | `@digitalvantage/payload-visual-editor-core` | Site SDK, vanilla TS, **zero runtime deps**: protocol, attrs, scanner, bridge, overlay |
| `packages/react` | `@digitalvantage/payload-visual-editor-react` | React adapter: `<VisualEditing/>`, `payloadEditable()` |
| `dev` | private | Next + Payload playground: `pages`/`posts`/`categories`/`edge-cases`/`media` collections, `header` global, `/client-mode/[slug]` + `/ssr-mode/[slug]` + `/posts/[slug]` + `/edge-cases/[slug]` |
| `test` | private | vitest int tests (`int/`), Playwright e2e (`e2e/`, drives `dev/`) |

## Commands

- `pnpm install` then `pnpm build` (builds packages in dependency order: core → plugin/react)
- `pnpm test` — vitest int tests (**run `pnpm build` first**: everything consumes built `dist/`)
- `pnpm check` — build + lint + package lint (`publint` + `attw` on the packed tarballs) + format check + typecheck + int tests; the local stand-in for CI, run before every commit
- `pnpm lint` / `pnpm format` — ESLint / Prettier (`pnpm lint:fix`, `pnpm format:check`); `pnpm typecheck` also covers `test/` and `dev/` (regenerates `dev/payload-types.ts` first)
- Git hooks live in `.githooks/` (`pre-push` runs `pnpm check`); `pnpm install` wires them up via the root `prepare` script, together with `blame.ignoreRevsFile`
- `pnpm e2e` — Playwright e2e on chromium (starts the playground on the port from `dev/.env` `NEXT_PUBLIC_SERVER_URL`); `pnpm e2e:browsers` runs chromium + firefox + webkit serially (WebKit on Linux needs `pnpm --filter @digitalvantage/payload-visual-editor-tests exec playwright install-deps webkit` — no `sudo` in front: Playwright lives in `test/`, `sudo` drops the nvm `PATH`, and the command asks for the password itself). Specs import `test` from `test/fixtures.ts`, not `@playwright/test`: it fails a test on any plugin console warning/error in either frame
- `pnpm release:verify` — `scripts/release-verify.sh`: packs the tarballs, installs them into the blank Payload app in `verify/consumer` (copied to a temp dir) for each matrix entry (`min` = payload 3.85 + next 15.4, `latest`), runs migrations + `next build` + `next start` on port 3457, then the browser smoke test in `test/consumer/` twice: same-origin preview, then cross-origin (`PVE_SITE_URL=http://127.0.0.1:3457`)
- `pnpm dev` — builds packages, then dev playground at http://localhost:3000 (admin at `/admin`, login `dev@payloadcms.com` / `test`; seeded on first run)
- `pnpm watch` — SWC watch-rebuild of all packages (run alongside `pnpm --filter dev dev` when iterating on package code)
- `pnpm --filter dev generate:importmap` — regenerate `dev/app/(payload)/admin/importMap.js` after adding/renaming admin components
- `pnpm --filter dev generate:types` — regenerate `dev/payload-types.ts` after schema changes

## Architecture invariants (do not violate)

- **The stock Live Preview data pipeline stays untouched.** Document data flows through `payload-live-preview` messages only; our `payload-visual-editor:*` protocol carries intent/metadata only.
- **The overlay renders inside the site iframe** (core SDK). Never do cross-frame rect math — Live Preview scales the iframe with a CSS transform.
- **`packages/core/src/protocol.ts` is the single source of truth** for message types; the plugin imports it from `@digitalvantage/payload-visual-editor-core`.
- **Every `@payloadcms/ui` / Payload-internal import in the plugin goes through `packages/plugin/src/internal/payload-internals.ts`** — one choke point so version breakage surfaces in one file.
- **postMessage security:** explicit `targetOrigin` (never `'*'`), admin checks `event.source` against the iframe, per-load `sessionId`, SDK stays inert until a valid `hello` from the allowed origin.
- **Plugins cannot register Payload server functions** — custom server work goes through REST `endpoints` only.
- **Paths are form-state data paths** (`layout.0.heading`); row identity across frames is the stable row `id` (ObjectId hex), never a bare index. Admin re-resolves indices from form-state `rows` by id before dispatching ops.
- **DOM→data mapping is explicit `data-pve-*` attributes only.** No stega/string encoding.

## Conventions

- ESM only; packages use `module: NodeNext` — relative imports inside `packages/*` need explicit `.js` extensions.
- Package `exports` point at built `dist/` **always** (dev app, tests, and consumers all get the same artifact — Turbopack cannot resolve `.js`→`.ts` in linked TS sources, so src-based exports are a dead end). Build = SWC transpile + `tsc --build` for declarations (project references: plugin/react reference core, so core must build first — `pnpm build` handles order).
- Client components carry `'use client'` in the component file itself; `exports/client.ts` only re-exports.
- Admin components are registered as import-map strings (`@digitalvantage/payload-visual-editor/client#VisualEditorController`); changing them requires regenerating the dev import map.
- **No GitHub CI** — the user declined workflows. Verify locally; release manually per `RELEASING.md`.

## Dev playground fixtures

- **`edge-cases` holds the schema shapes the main fixtures lack** (global blocks via `blockReferences`, wrappers inside blocks, a nested referenced container, a localized field, no drafts). Its e2e tests create their own documents and pin `?locale=en`, because the admin persists the chosen locale per user.
- **`home` and `ssr-home` are frozen e2e fixtures** — layout indices are asserted on. New demo content belongs in `landing`/`about`/`ssr-showcase` or the posts.
- Seed images are synthesized at seed time by `dev/lib/images.ts` (sharp + deterministic SVG gradients); `dev/media/` is gitignored so no binaries are committed.
- `Media` needs `access: { read: () => true }` — pages render through the Local API (access bypassed) but the browser pulls files over REST, which otherwise 403s for anonymous visitors.
- The doc-switch e2e test restores the `header` global from a hardcoded copy of the seed — keep it in sync with `dev/seed.ts`.
