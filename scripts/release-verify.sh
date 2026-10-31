#!/usr/bin/env bash
# Release verification: install the packed tarballs (what npm would ship, not
# workspace links) into a blank Payload app, `next build` it, start it, and run
# the browser smoke test. Once per matrix entry.
#
# Usage:  scripts/release-verify.sh [entry...]       entries: min latest (default: both)
# Env:    PVE_VERIFY_BROWSERS="chromium firefox"     Playwright projects (default: chromium)
#         PVE_VERIFY_KEEP=1                          keep the temp dir for debugging
#         PVE_VERIFY_PORT=3457
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PVE_VERIFY_PORT:-3457}"
BROWSERS="${PVE_VERIFY_BROWSERS:-chromium}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/pve-release-verify.XXXXXX")"

# name → "payload-version next-version". min = the lowest versions the peer
# ranges promise: payload@3.85.0 only supports next 15.4.11+ on the 15 line.
declare -A MATRIX=(
  [min]="3.85.0 ~15.4.11"
  [latest]="latest ^16"
)
ENTRIES=("$@")
[ ${#ENTRIES[@]} -eq 0 ] && ENTRIES=(min latest)

# `next start` forks a next-server child that outlives its parent: stop
# whatever listens on the port instead of tracking PIDs
stop_port() {
  local pids
  pids="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ] && command -v ss >/dev/null; then
    pids="$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)"
  fi
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
}

cleanup() {
  stop_port
  if [ "${PVE_VERIFY_KEEP:-}" = "1" ]; then
    echo "Kept $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

log() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT"; then
  echo "Port $PORT is already in use — set PVE_VERIFY_PORT" >&2
  exit 2
fi

log "Building and packing the packages"
(cd "$ROOT" && pnpm build >/dev/null)
mkdir -p "$WORK/tarballs"
for pkg in core react plugin; do
  (cd "$ROOT/packages/$pkg" && pnpm pack --pack-destination "$WORK/tarballs" >/dev/null)
done
tarball() { ls "$WORK/tarballs/"digitalvantage-"$1"-[0-9]*.tgz; }
CORE="$(tarball payload-visual-editor-core)"
REACT="$(tarball payload-visual-editor-react)"
PLUGIN="$(tarball payload-visual-editor)"

declare -A RESULT=()
for entry in "${ENTRIES[@]}"; do
  if [ -z "${MATRIX[$entry]:-}" ]; then
    echo "Unknown matrix entry: $entry (known: ${!MATRIX[*]})" >&2
    exit 2
  fi
  read -r PAYLOAD_VERSION NEXT_VERSION <<<"${MATRIX[$entry]}"
  APP="$WORK/app-$entry"
  log "[$entry] payload@$PAYLOAD_VERSION + next@$NEXT_VERSION in $APP"
  cp -r "$ROOT/verify/consumer" "$APP"

  # Pin the Payload family + Next; install the plugin packages from the tarballs.
  # The overrides (pnpm-workspace.yaml: pnpm 10 ignores them in package.json)
  # matter: the packed plugin depends on core by version, which would
  # otherwise resolve to whatever core is on the npm registry.
  node - "$APP/package.json" "$ROOT/package.json" "$PAYLOAD_VERSION" "$NEXT_VERSION" "$CORE" "$REACT" "$PLUGIN" <<'EOF'
const fs = require('fs')
const [file, rootFile, payloadVersion, nextVersion, core, react, plugin] = process.argv.slice(2)
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
// Same pnpm as the repo: settings names differ across majors (onlyBuiltDependencies → allowBuilds)
pkg.packageManager = JSON.parse(fs.readFileSync(rootFile, 'utf8')).packageManager
for (const name of Object.keys(pkg.dependencies)) {
  if (pkg.dependencies[name] === 'RELEASE_VERIFY') {
    pkg.dependencies[name] = name === 'next' ? nextVersion : payloadVersion
  }
}
Object.assign(pkg.dependencies, {
  '@digitalvantage/payload-visual-editor': `file:${plugin}`,
  '@digitalvantage/payload-visual-editor-core': `file:${core}`,
  '@digitalvantage/payload-visual-editor-react': `file:${react}`,
})
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
EOF
  printf "overrides:\n  '@digitalvantage/payload-visual-editor-core': 'file:%s'\n" "$CORE" >>"$APP/pnpm-workspace.yaml"

  if (
    cd "$APP"
    export NEXT_PUBLIC_SERVER_URL="http://localhost:$PORT" NEXT_TELEMETRY_DISABLED=1
    pnpm install --config.strict-peer-dependencies=false >install.log 2>&1 || { tail -30 install.log; exit 1; }
    # A registry copy here means the test would exercise the published code
    if ls node_modules/.pnpm | grep -E '^@digitalvantage\+[a-z-]+@[0-9]'; then
      echo "  ✗ the packages above resolved from the npm registry, not the tarballs" >&2
      exit 1
    fi
    echo "  installed: $(pnpm list payload next --depth 0 | grep -oE '(payload|next)@[0-9][^ ]*' | tr '\n' ' ')"
    pnpm generate:importmap >gen.log 2>&1 && pnpm generate:types >>gen.log 2>&1 || { tail -30 gen.log; exit 1; }
    # Production mode never pushes the schema: create it the way a deployed
    # consumer does, through a migration
    { pnpm exec payload migrate:create initial && pnpm exec payload migrate; } </dev/null >migrate.log 2>&1 || { tail -30 migrate.log; exit 1; }
    pnpm build >build.log 2>&1 || { tail -40 build.log; exit 1; }
    echo "  next build ok"
    pnpm start --port "$PORT" >server.log 2>&1 &
    for _ in $(seq 1 60); do
      curl -sf "http://localhost:$PORT/admin/login" >/dev/null && break
      sleep 2
    done
    curl -sf "http://localhost:$PORT/admin/login" >/dev/null || { tail -30 server.log; exit 1; }
  ); then
    PROJECTS=()
    for browser in $BROWSERS; do PROJECTS+=("--project=$browser"); done
    if (cd "$ROOT/test" && PVE_CONSUMER_URL="http://localhost:$PORT" npx playwright test -c playwright.consumer.config.ts "${PROJECTS[@]}"); then
      RESULT[$entry]=pass
    else
      RESULT[$entry]=fail
    fi
    stop_port
  else
    stop_port
    RESULT[$entry]=fail
  fi
done

log "Summary"
status=0
for entry in "${ENTRIES[@]}"; do
  echo "  $entry (${MATRIX[$entry]}): ${RESULT[$entry]}"
  [ "${RESULT[$entry]}" = pass ] || status=1
done
exit $status
