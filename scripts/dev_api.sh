#!/usr/bin/env bash
# Starts the FastAPI dev server and, when the Stripe CLI is installed and logged in,
# a `stripe listen` forwarding webhooks to it. Opt out with STRIPE_LISTEN=0.
set -euo pipefail

export PATH="$PATH:$HOME/.stripe/bin"  # default Stripe CLI install dir
PORT="${API_PORT:-8100}"
EVENTS="checkout.session.completed,checkout.session.async_payment_succeeded"
cd "$(dirname "$0")/../apps/api"

if [[ "${STRIPE_LISTEN:-1}" != "0" ]] && command -v stripe >/dev/null 2>&1; then
  if secret="$(stripe listen --print-secret 2>/dev/null)" && [[ "$secret" == whsec_* ]]; then
    # Env vars take precedence over .env in pydantic-settings: no need to copy the secret by hand.
    export STRIPE_WEBHOOK_SECRET="$secret"
    stripe listen --events "$EVENTS" --forward-to "localhost:${PORT}/api/stripe/webhook" \
      > >(sed -u 's/^/[stripe] /') 2>&1 &
    STRIPE_PID=$!
    trap 'kill "$STRIPE_PID" 2>/dev/null || true' EXIT
  else
    echo "[stripe] CLI not logged in or offline (run: stripe login) — starting API without webhooks" >&2
  fi
else
  echo "[stripe] webhook forwarding disabled — starting API without it" >&2
fi

uv run uvicorn trainscanner.main:app --reload --port "$PORT"
