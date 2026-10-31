# Releasing

Manual release checklist (no CI publishing). Every release goes through a release candidate first. The goal is that nothing reaches `latest` that has only been tested inside this repo.

## 1. Pre-flight

1. **Naming**: the plugin publishes as `@digitalvantage/payload-visual-editor`, with the SDK packages as `@digitalvantage/payload-visual-editor-core` and `@digitalvantage/payload-visual-editor-react`. The `digitalvantage` scope must exist on npm (an org or a user of that name) before the first publish.
2. Bump the version in `packages/{core,plugin,react}/package.json` (keep all three in lockstep) and `SDK_VERSION` in `packages/core/src/protocol.ts`. For a candidate use a prerelease version: `1.1.0-rc.0`, `1.1.0-rc.1`, …
3. Add the release section to `CHANGELOG.md`: version heading, date, and the changes grouped under Added / Changed / Fixed / Removed / Security. Candidates do not get their own section; the final version's section covers them.

## 2. Automated verification

From a clean state:

```sh
pnpm clean && pnpm install
pnpm check            # build + lint + package lint + format + types + int tests
pnpm e2e:browsers     # playground e2e on chromium, firefox, webkit (starts the playground itself)
pnpm release:verify   # packed tarballs → blank Payload app → next build → browser smoke test
```

`pnpm release:verify` (`scripts/release-verify.sh`) runs the smoke test once per matrix entry, twice each: with the preview on the admin's origin, then on a different one (`127.0.0.1` vs `localhost`, the same app):

| Entry | Payload | Next | Why |
|---|---|---|---|
| `min` | `3.85.0` | `~15.4.11` | The lowest versions the peer ranges promise |
| `latest` | `latest` | `^16` | What a new project installs today |

It installs the packages from `pnpm pack` output (not workspace links), so it catches broken `exports`, missing `dist/` files, missing `'use client'`, import-map paths and README drift. Options: `scripts/release-verify.sh min` runs a single entry, `PVE_VERIFY_BROWSERS="chromium firefox webkit"` sets the browsers, `PVE_VERIFY_KEEP=1` keeps the temp app (with its `install.log`, `build.log`, `server.log`) for debugging, `PVE_VERIFY_PORT` moves the app off port 3457. The app runs in production mode, so its schema comes from a real `payload migrate`, as on a deployed site.

WebKit needs system libraries on Linux: `pnpm --filter @digitalvantage/payload-visual-editor-tests exec playwright install-deps webkit` — no `sudo` in front: Playwright lives in `test/`, `sudo` drops the nvm `PATH`, and the command asks for the password itself (once per machine).

## 3. Manual checklist

These need a human looking at the screen. Run them on the release candidate in the dev playground (`pnpm dev`) and tick them in the release notes. They take about 10 minutes:

- [ ] **Client and SSR mode**: edit a heading, add / duplicate / remove / reorder a block on `/client-mode/landing` and `/ssr-mode/ssr-showcase`; the SSR shimmer clears.
- [ ] **Dedicated view**: popover editing of text, rich text and an upload; save, then publish from the toolbar.
- [ ] **Read-only user** (`viewer@payloadcms.com` / `test`): no chips, no add affordances, popovers read-only.
- [ ] **Cross-document**: double-click the header global, edit it in the drawer, save; the page reflects it.
- [ ] **Cross-origin**: automated: `pnpm release:verify` runs the smoke test a second time with the preview on another origin (`127.0.0.1` vs `localhost`). Repeat by hand only for a real two-app setup (separate site and Payload servers, cookies across origins — see README → Cross-origin setups).
- [ ] **Browsers by hand**: one edit plus one drag-reorder in Firefox and Safari (WebKit e2e does not cover real Safari quirks).
- [ ] **Console**: automated: every e2e and smoke test fails on a plugin console warning/error in either frame (`test/fixtures.ts`). Still glance at both frames while clicking through.

## 4. Release candidate

```sh
pnpm publish -r --access public --tag next
```

The `next` dist-tag keeps the candidate off `latest`, so `pnpm add @digitalvantage/payload-visual-editor` keeps installing the previous stable version. Then:

1. Install it in at least one real Digital Vantage project: `pnpm add @digitalvantage/payload-visual-editor@next @digitalvantage/payload-visual-editor-react@next`.
2. Use it for real editing for a day or two, on that project's own content and block schema.
3. If something breaks: fix, bump to `-rc.N+1`, repeat from step 2 of this checklist.

## 5. Publish

Set the final version (drop the `-rc.N` suffix), make sure `CHANGELOG.md` has its section, run `pnpm check` and `pnpm release:verify` once more, then:

```sh
pnpm publish -r --access public
```

`pnpm publish -r` publishes in dependency order (core first) and rewrites `workspace:*` ranges to the real versions.

## 6. After publishing

- Tag the release: `git tag v1.1.0 && git push origin v1.1.0`.
- Add the `payload-plugin` topic to the GitHub repository (Settings → Topics) so the plugin is discoverable.
- Point the candidate projects at the final version: `pnpm add @digitalvantage/payload-visual-editor@latest …`.
