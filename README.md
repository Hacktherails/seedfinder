# 🚆 Train Scanner

**Hack the Rails 2026 · Platform 2 — Trip Planner, built with Stripe.** The challenger to Skyscanner and Omio:
search, compare, combine and pay for multi-leg journeys across Europe in one flow. Payments run on Stripe.

**New on the team? → [`docs/SETUP.md`](docs/SETUP.md) (install, FR).**

## Quickstart

Prereqs: Node ≥ 20.19 (26 recommended, see `.nvmrc`), [uv](https://docs.astral.sh/uv/) (installs Python 3.11 by itself).

```bash
npm run setup          # npm install + uv sync
cp .env.example .env   # fill Stripe TEST keys
npm run dev:api        # FastAPI on :8100  (docs: http://localhost:8100/docs)
npm run dev            # Vite on :5173, proxies /api → :8100
```

| Command | What |
| --- | --- |
| `npm run check` | everything CI runs: lint, format check, tests, build — run before every push |
| `npm test` | backend tests (pytest) |
| `npm run lint` | oxlint + ruff |
| `npm run build` | production web build |
| `npm run gen:api` | regenerate `contracts/openapi.json` after changing the API models |
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
