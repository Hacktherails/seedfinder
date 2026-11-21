#!/usr/bin/env bash
# One command to install, configure and run Train Scanner locally.
#
#   npm start                 # install if needed, ask for Stripe test keys once, run API + web (+ webhooks)
#   npm start -- --share      # same, plus a public https URL (Cloudflare Quick Tunnel, no account needed)
#   npm start -- --reset      # wipe the seeds ledger first (fresh demo)
#   npm start -- --offline    # no WiFi needed: journeys replayed from the committed demo cache
#   npm start -- --prod       # build and run the production Docker image (what gets deployed)
#
# Env: API_PORT (default 8100), WEB_PORT (default 5173), STRIPE_LISTEN=0 to skip webhook forwarding.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$PATH:$HOME/.stripe/bin:$HOME/.local/bin"
export API_PORT="${API_PORT:-8100}"
WEB_PORT="${WEB_PORT:-5173}"
SHARE=0 RESET=0 PROD=0 OFFLINE=0
for arg in "$@"; do
  case "$arg" in
    --share) SHARE=1 ;;
    --reset) RESET=1 ;;
    --prod) PROD=1 ;;
    --offline) OFFLINE=1 ;;
    -h | --help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

bold=$'\e[1m' green=$'\e[32m' yellow=$'\e[33m' red=$'\e[31m' reset=$'\e[0m'
step() { printf '%s▸ %s%s\n' "$bold" "$*" "$reset"; }
ok() { printf '  %s✓%s %s\n' "$green" "$reset" "$*"; }
warn() { printf '  %s!%s %s\n' "$yellow" "$reset" "$*"; }
die() { printf '  %s✗ %s%s\n' "$red" "$*" "$reset" >&2; exit 1; }

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# ── 1. Tools ────────────────────────────────────────────────────────────────
step "Checking tools"
command -v node >/dev/null || die "Node.js missing → https://nodejs.org (or: mise use node@26)"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)' \
  || die "Node $(node -v) too old, need ≥ 20.19"
ok "node $(node -v)"
if [[ $PROD == 1 ]]; then
  command -v docker >/dev/null || die "Docker missing (needed for --prod)"
else
  command -v uv >/dev/null || die "uv missing → curl -LsSf https://astral.sh/uv/install.sh | sh"
  ok "$(uv --version)"
fi
if command -v stripe >/dev/null; then ok "stripe CLI $(stripe version 2>/dev/null | head -1)"; else
  warn "Stripe CLI not found: payments still work (the app confirms them with Stripe), but no local webhooks."
  warn "  Optional: https://docs.stripe.com/stripe-cli then 'stripe login'"
fi

# ── 2. .env with Stripe TEST keys ───────────────────────────────────────────
step "Configuring .env"
[[ -f .env ]] || { cp .env.example .env; chmod 600 .env; ok "created .env from .env.example"; }
get_env() { sed -n "s/^$1=//p" .env | tail -1; }
set_env() {
  if grep -q "^$1=" .env; then
    local tmp; tmp="$(mktemp)"
    awk -v k="$1" -v v="$2" 'BEGIN{FS=OFS="="} $1==k{print k "=" v; next} {print}' .env > "$tmp" && cat "$tmp" > .env && rm -f "$tmp"
  else printf '%s=%s\n' "$1" "$2" >> .env; fi
}
ask_key() { # name prefix hint
  local cur; cur="$(get_env "$1")"
  if [[ "$cur" == "$2"* ]]; then ok "$1 set"; return; fi
  [[ -n "$cur" ]] && die "$1 must start with $2 (test mode only, never a live key)"
  if [[ ! -t 0 ]]; then warn "$1 empty → demo mode (no real Stripe)"; return; fi
  local v
  read -r -p "  $1 ($3, Enter to skip = demo mode): " v
  if [[ -z "$v" ]]; then warn "$1 skipped → demo mode"; return; fi
  [[ "$v" == "$2"* ]] || die "$1 must start with $2"
  set_env "$1" "$v"; ok "$1 saved to .env"
}
ask_key STRIPE_SECRET_KEY sk_test_ "dashboard.stripe.com/test/apikeys → Secret key"
ask_key VITE_STRIPE_PUBLISHABLE_KEY pk_test_ "same page → Publishable key"

# ── 3a. Production image ────────────────────────────────────────────────────
if [[ $PROD == 1 ]]; then
  step "Building production image (docker build)"
  docker build -t trainscanner .
  port_busy "$API_PORT" && die "port $API_PORT busy (set API_PORT=…)"
  step "Running on http://localhost:$API_PORT  (Ctrl-C to stop)"
  exec docker run --rm -it --env-file .env -e PORT=8100 -p "$API_PORT:8100" trainscanner
fi

# ── 3b. Dependencies (only when out of date) ────────────────────────────────
step "Installing dependencies"
if [[ ! -d node_modules || package-lock.json -nt node_modules/.package-lock.json ]]; then
  npm install --no-audit --no-fund --loglevel=error
fi
ok "web dependencies"
(cd apps/api && uv sync --quiet)
ok "api dependencies"

[[ $RESET == 1 ]] && { rm -rf .data; ok "ECO ledger reset"; }
if [[ $OFFLINE == 1 ]]; then
  # Env beats .env for both pydantic-settings and Vite. Stripe is unreachable too: demo payments
  # (order confirmed at once, seeds still earned and spent).
  export OFFLINE_DEMO=true STRIPE_LISTEN=0 STRIPE_SECRET_KEY= VITE_STRIPE_PUBLISHABLE_KEY=
  ok "offline demo: journeys from the demo cache, payments in demo mode (refresh cache online: npm run warm:cache)"
fi

# ── 4. Run ──────────────────────────────────────────────────────────────────
port_busy "$API_PORT" && die "port $API_PORT already in use (another 'npm run dev:api'?). Stop it or set API_PORT=…"
port_busy "$WEB_PORT" && die "port $WEB_PORT already in use (another 'npm run dev'?). Stop it or set WEB_PORT=…"

PIDS=()
killtree() { # children first, so nothing gets re-parented and survives (uvicorn reloader, vite, tunnel)
  local c
  for c in $(pgrep -P "$1" 2>/dev/null); do killtree "$c"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {
  trap - EXIT INT TERM
  for c in $(pgrep -P $$ 2>/dev/null); do killtree "$c"; done
  [[ $SHARE == 1 ]] && docker rm -f trainscanner-tunnel >/dev/null 2>&1 || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
prefix() { sed -u "s/^/$1 /"; }

step "Starting"
scripts/dev_api.sh > >(prefix "[api]") 2>&1 &
PIDS+=($!)
npm run dev -w apps/web -- --port "$WEB_PORT" --strictPort > >(prefix "[web]") 2>&1 &
PIDS+=($!)

for _ in $(seq 60); do
  curl -fs "http://localhost:$API_PORT/api/health" >/dev/null 2>&1 && curl -fs "http://localhost:$WEB_PORT" >/dev/null 2>&1 && break
  sleep 1
done
curl -fs "http://localhost:$API_PORT/api/health" >/dev/null || die "API did not start, see [api] logs above"

if [[ $SHARE == 1 ]]; then
  TUNNEL_LOG="$(mktemp)"
  if command -v cloudflared >/dev/null; then
    cloudflared tunnel --no-autoupdate --url "http://localhost:$WEB_PORT" > "$TUNNEL_LOG" 2>&1 &
  elif command -v docker >/dev/null; then
    docker run --rm --name trainscanner-tunnel --network host cloudflare/cloudflared:latest tunnel --no-autoupdate \
      --url "http://localhost:$WEB_PORT" > "$TUNNEL_LOG" 2>&1 &
  else
    die "--share needs cloudflared or Docker"
  fi
  PIDS+=($!)
  for _ in $(seq 40); do
    PUBLIC_URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
    [[ -n "$PUBLIC_URL" ]] && break
    sleep 1
  done
  [[ -n "${PUBLIC_URL:-}" ]] || { cat "$TUNNEL_LOG"; die "tunnel did not start"; }
fi

printf '\n%s  Train Scanner is running%s\n' "$bold" "$reset"
printf '  App       %shttp://localhost:%s%s\n' "$green" "$WEB_PORT" "$reset"
printf '  API docs  http://localhost:%s/docs\n' "$API_PORT"
[[ -n "${PUBLIC_URL:-}" ]] && printf '  Public    %s%s%s  (anyone with the link, until Ctrl-C)\n' "$green" "$PUBLIC_URL" "$reset"
[[ $OFFLINE == 0 && "$(get_env STRIPE_SECRET_KEY)" == sk_test_* ]] && printf '  Test card 4242 4242 4242 4242 · any future date · any CVC\n'
printf '  Ctrl-C to stop\n\n'
wait -n "${PIDS[@]}" || true
