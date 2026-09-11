#!/usr/bin/env bash
set -euo pipefail

# Runs the Playwright E2E suite against a genuinely live, self-hosted Cap
# Standalone + Valkey instance (PR1's docker-compose.yml) instead of mocking
# the Cap network call — see tests/e2e/README.md for why this approach was
# chosen for PR5.
#
# What this script does, in order:
#   1. Brings up `cap` + `valkey` from docker-compose.yml with a dev-only
#      admin key and a permissive local CORS origin (never used in
#      production — production config comes from the real deployment's own
#      secrets, never from this script).
#   2. Logs into Cap's own admin REST API (`POST /auth/login`) and creates a
#      throwaway site key + secret key (`POST /server/keys`) — the same
#      admin flow a human would otherwise perform once through Cap's
#      dashboard UI, done here non-interactively so the whole suite is
#      reproducible in one command.
#   3. Builds the app with `PUBLIC_CAP_API_URL` / `PUBLIC_CAP_SITE_KEY`
#      baked in (Vite inlines `PUBLIC_`-prefixed vars at build time) and
#      `CONTACT_EMAIL_TEST_MODE=true` so the real `/api/contacto` pipeline
#      can reach a genuine success response without a real SMTP account
#      (SMTP provider selection is a separate, still-open decision — see
#      spec "Open Items"; this never fabricates one).
#   4. Starts `astro preview`, waits for it, runs the Playwright suite
#      against it, then tears down both the preview server and the
#      Cap/Valkey containers it started.
#
# Never commit real values for CAP_ADMIN_KEY/CAP_SECRET_KEY — these are
# generated fresh on every run and only ever live in this script's process
# environment.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CAP_URL="http://localhost:3000"
APP_URL="http://localhost:4321"
DEV_ADMIN_KEY="e2e-dev-admin-key-not-for-prod"

cleanup() {
  echo "[e2e] Cleaning up..."
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
  fi
  docker compose stop cap valkey >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[e2e] Starting Cap + Valkey..."
CAP_ADMIN_KEY="$DEV_ADMIN_KEY" CAP_CORS_ORIGIN="*" docker compose up -d cap valkey

echo "[e2e] Waiting for Cap to respond..."
for _ in $(seq 1 30); do
  if curl -sSf "$CAP_URL/" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[e2e] Provisioning a throwaway Cap site key..."
LOGIN_JSON=$(curl -sSf -X POST "$CAP_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"admin_key\":\"$DEV_ADMIN_KEY\"}")
SESSION_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).session_token)" "$LOGIN_JSON")
HASHED_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).hashed_token)" "$LOGIN_JSON")
BEARER=$(node -e "console.log(Buffer.from(JSON.stringify({token:process.argv[1],hash:process.argv[2]})).toString('base64'))" \
  "$SESSION_TOKEN" "$HASHED_TOKEN")

KEY_JSON=$(curl -sSf -X POST "$CAP_URL/server/keys" \
  -H "Authorization: Bearer $BEARER" \
  -H 'Content-Type: application/json' \
  -d '{"name":"e2e-run","corsOrigins":["http://localhost:4321"]}')
SITE_KEY=$(node -e "console.log(JSON.parse(process.argv[1]).siteKey)" "$KEY_JSON")
SECRET_KEY=$(node -e "console.log(JSON.parse(process.argv[1]).secretKey)" "$KEY_JSON")

echo "[e2e] Site key provisioned: $SITE_KEY"

export CAP_API_URL="$CAP_URL"
export PUBLIC_CAP_API_URL="$CAP_URL"
export PUBLIC_CAP_SITE_KEY="$SITE_KEY"
export CAP_SECRET_KEY="$SECRET_KEY"
export CONTACT_RECIPIENT_EMAIL="e2e-test-recipient@example.invalid"
export CONTACT_EMAIL_TEST_MODE="true"

echo "[e2e] Building..."
pnpm build

echo "[e2e] Starting preview server..."
pnpm preview >/tmp/alba-abogacia-e2e-preview.log 2>&1 &
PREVIEW_PID=$!

echo "[e2e] Waiting for $APP_URL..."
for _ in $(seq 1 30); do
  if curl -sSf "$APP_URL/" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[e2e] Running Playwright..."
pnpm exec playwright test "$@"
