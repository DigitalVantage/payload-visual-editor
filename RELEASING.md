# Releasing

Manual release checklist (no CI publishing).

## Pre-flight

1. **Naming**: the plugin publishes as `@digitalvantage/payload-visual-editor`, with the SDK packages as `@digitalvantage/payload-visual-editor-core` and `@digitalvantage/payload-visual-editor-react`. The `digitalvantage` scope must exist on npm (an org or a user of that name) before the first publish.
2. Bump the version in `packages/{core,plugin,react}/package.json` (keep all three in lockstep) and `SDK_VERSION` in `packages/core/src/protocol.ts`.
3. Add the release section to `CHANGELOG.md` — version heading, date, and the changes grouped under Added / Changed / Fixed / Removed / Security.
4. Verify everything from a clean state:

   ```sh
   pnpm clean && pnpm install && pnpm build
   pnpm test
   pnpm e2e     # starts the dev playground itself
   ```

5. Inspect what would be published (README, LICENSE, and `dist/` only):

   ```sh
   pnpm -r --filter './packages/*' exec npm pack --dry-run
   ```

## Publish

`pnpm publish -r` publishes in dependency order (core first) and rewrites `workspace:*` ranges to the real versions:

```sh
pnpm publish -r --access public
```

## After publishing

- Tag the release: `git tag v1.0.0 && git push origin v1.0.0`.
- Add the `payload-plugin` topic to the GitHub repository (Settings → Topics) so the plugin is discoverable.
- Smoke-test the published artifacts in a scratch Payload app: install the plugin, run `payload generate:importmap`, open Live Preview, toggle edit mode.
