# 🌱 SeedFinder

> **The eco-friendly train booking platform.**

**Hack the Rails 2026 · Platform 2 — Trip Planner, built with Stripe.** Search, compare, combine and pay for
multi-leg train journeys across Europe in one flow. Payments run on Stripe (test mode).

**New on the team? → [`docs/SETUP.md`](docs/SETUP.md) (install, FR).**

## Run locally

### Prerequisites

- **Node.js ≥ 20.19** (26 recommended, see `.nvmrc`)
- **[uv](https://docs.astral.sh/uv/)**: `curl -LsSf https://astral.sh/uv/install.sh | sh` (installs Python 3.11 by itself)
- *Optional:* [Stripe CLI](https://docs.stripe.com/stripe-cli) + `stripe login`, for local webhook forwarding
- *Optional:* Stripe **test** keys (`sk_test_…` / `pk_test_…`) from
  [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys). Without them the app runs in demo
  mode (orders confirmed at once, no real Stripe call).

### One command

```bash
git clone https://github.com/Hacktherails/seedfinder.git && cd seedfinder
npm start
```

`npm start` checks your tools, creates `.env` from `.env.example`, asks once for your Stripe test keys (Enter to skip),
installs dependencies, then runs the API, the web app and (if the Stripe CLI is logged in) webhook forwarding.

| URL | What |
| --- | --- |
| http://localhost:5173 | the app |
| http://localhost:8100/docs | API docs (OpenAPI UI) |

Test card: `4242 4242 4242 4242`, any future date, any CVC. Ctrl-C stops everything.

| Variant | What |
| --- | --- |
| `npm start -- --offline` | no network needed: journeys replayed from the committed demo cache, demo payments |
| `npm start -- --reset` | wipe the local seeds ledger (`.data/`) for a fresh demo |
| `npm start -- --share` | also expose a public https URL (Cloudflare Quick Tunnel, needs `cloudflared` or Docker) |
| `npm start -- --prod` | build and run the production Docker image |

Ports: `API_PORT` (default 8100) and `WEB_PORT` (default 5173) override them; `STRIPE_LISTEN=0` skips webhooks.

### Manual (two terminals)

```bash
npm run setup          # npm install + uv sync
cp .env.example .env   # fill Stripe TEST keys (optional)
npm run dev:api        # terminal 1: FastAPI on :8100 (+ stripe listen if the CLI is logged in)
npm run dev            # terminal 2: Vite on :5173, proxies /api → :8100
```

### Useful commands

| Command | What |
| --- | --- |
| `npm run check` | everything CI runs: lint, format check, tests, build — run before every push |
| `npm test` | backend tests (pytest) |
| `npm run lint` | oxlint + ruff |
| `npm run build` | production web build |
| `npm run gen:api` | regenerate `contracts/openapi.json` after changing the API models |
| `npm run warm:cache` | refresh the offline demo cache (needs network) |
| `scripts/aikido_release_gate.sh` | release gate: Aikido Local Scanner in Docker (needs `AIKIDO_API_KEY` in `.env`) |

## Layout

```
apps/api/trainscanner/      FastAPI (Python 3.11, Pydantic v2)
  main.py                   router wiring only, /api/health
  config.py                 settings, loads the repo-root .env
  routes/                   API endpoints
apps/web/src/               React + Vite + Tailwind
  api/client.ts             fetch wrapper
  api/types.ts              TS mirror of the API models
contracts/openapi.json      exported API contract (npm run gen:api)
scripts/                    release gate & tooling
```

## Team rules

- **Stripe test mode only.** Secret key (`sk_test_…`) and webhook secret stay server-side in `.env`; only
  `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) may reach the browser. Never commit `.env`.
- **Prices come from the API.** The web app never recomputes totals; amounts are integers in minor units (cents).
- **Contract changes** (API models) ⇒ update `apps/web/src/api/types.ts` + `npm run gen:api` in the same PR.
- Small PRs into `main`, CI must be green. Mention `@claude` in an issue/PR for help.
- **15:45 hard feature freeze.**

## Demo day (Sun 22 Nov 2026, BeCentral, Cantersteen 12)

| Time | |
| --- | --- |
| 10:00 | Doors — arrive set up (repo cloned, `npm run setup` done, logins OK) |
| 10:30 | Kickoff (1st floor Central Hall) |
| ~10:45–12:30 | Sprint 1 (2nd floor Factory) |
| 12:45–13:15 | Working lunch — validate with mentors |
| 13:15–15:45 | Sprint 2 · 14:45 integration checkpoint |
| 15:45 | **Freeze** → release gate, offline test |
| 16:45 | Screencast backup, timed rehearsals |
| 17:25 / 17:40 | Stage call / live demos (project auctioned at pitch) |
