# Contributing

Thanks for wanting to help. Bug reports, docs fixes, recipes for other frameworks and code are all welcome.

- **Found a bug?** Open an issue with the bug template. Payload / Next versions and the preview mode (client or SSR) usually decide the answer.
- **Want a feature?** Check the [roadmap issues](https://github.com/DigitalVantage/payload-visual-editor/issues) first. Items labelled `needs-feedback` wait for real use cases — a comment describing yours helps more than a 👍.
- **Want to write code?** Issues labelled `good first issue` or `help wanted` are a good start. For anything larger, comment on the issue before you start, so we can agree on the approach.
- **Found a security problem?** Do not open a public issue — see [SECURITY.md](./SECURITY.md).

## Setup

Requirements: Node 20+, pnpm 10 (`corepack enable` picks the pinned version).

```sh
pnpm install      # also wires the git hooks in .githooks/
pnpm dev          # builds the packages, starts the playground at http://localhost:3000
```

Admin: `http://localhost:3000/admin`, login `dev@payloadcms.com` / `test` (seeded on first run). `viewer@payloadcms.com` / `test` is a read-only account. Open the **Home** page and switch to Live Preview.

When you change package code, run `pnpm watch` in one terminal and `pnpm --filter dev dev` in another. Everything — the playground, the tests, consumers — imports the built `dist/`, not the sources.

## Repository map

| Path | What it is |
|---|---|
| `packages/core` | Site SDK, vanilla TypeScript with zero runtime dependencies: protocol, attributes, scanner, overlay |
| `packages/plugin` | Payload plugin: config changes and the admin-side controller |
| `packages/react` | React adapter: `<VisualEditing/>`, `payloadEditable()` |
| `dev` | Next + Payload playground used by the e2e tests |
| `test` | Vitest integration tests (`int/`), Playwright e2e (`e2e/`), the packed-tarball smoke test (`consumer/`) |

## Checks

```sh
pnpm check          # build + lint + package lint + format check + typecheck + int tests
pnpm e2e            # Playwright on Chromium (starts the playground itself)
pnpm e2e:browsers   # Chromium, Firefox and WebKit
```

`pnpm check` runs on `git push` through the pre-push hook. There is no CI, so the hook is the gate — please do not bypass it.

The e2e fixture in `test/fixtures.ts` fails a test on any plugin warning or error in the console of either frame. Import `test` from there, not from `@playwright/test`.

WebKit on Linux needs system libraries once per machine: `pnpm --filter @digitalvantage/payload-visual-editor-tests exec playwright install-deps webkit` (without `sudo`; it asks for the password itself).

## Design rules

These keep the editor safe to drop into any Payload site. A change that needs to break one is a discussion first, not a PR.

- **Document data flows only through Payload's stock Live Preview.** Our `payload-visual-editor:*` messages carry intent (paths, row ids), never field values.
- **The overlay lives inside the site iframe, in a shadow root** under the single `[data-pve-overlay]` host. No cross-frame position math (Live Preview scales the iframe with a CSS transform), no overlay elements in the page DOM.
- **The page says what is editable with explicit `data-pve-*` attributes.** No stega or text matching.
- **Rows are identified by their stable `id`**, never by an index alone; the admin re-resolves indices from form state before every operation.
- **postMessage is strict:** explicit `targetOrigin` (never `'*'`), `event.source` checked against the iframe, a per-load session id, and the SDK stays inert until a valid `hello`.
- **Every Payload-internal import in the plugin goes through `packages/plugin/src/internal/payload-internals.ts`**, so a Payload upgrade breaks one file.
- **`packages/core/src/protocol.ts` is the only place message types are defined.**

Code conventions: ESM only; relative imports inside `packages/*` need explicit `.js` extensions; client components carry `'use client'` in their own file.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): …`, `fix(plugin): …`, `docs: …`. Imperative mood, subject under ~72 characters.
- One logical change per commit. Keep refactors and behaviour changes in separate commits.
- Tests go in the same commit as the change they cover.
- For `feat`, `fix` and `perf`, add a line to `CHANGELOG.md` under `## [Unreleased]` (create the heading if it is not there).
- Admin components are registered by import-map path; if you add or rename one, run `pnpm --filter dev generate:importmap`. After schema changes in the playground, run `pnpm --filter dev generate:types`.

Releases are cut by the maintainers (see [RELEASING.md](./RELEASING.md)).

## License

By contributing you agree that your contribution is licensed under the [MIT License](./LICENSE), like the rest of the project.
