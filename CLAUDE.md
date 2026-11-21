# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

Hackathon project (Hack the Rails, 22 Nov 2026, "Platform 2 — Trip Planner, built with Stripe"). A challenger to
Skyscanner/Omio: search, compare, combine and pay for multi-leg journeys across Europe in one flow. Payments run on
Stripe (test mode). The project is auctioned at the pitch.

Team docs are in French (`docs/SETUP.md`). Code, comments and commits are in English.

## Commands

Monorepo: npm workspace `apps/web` + uv project `apps/api` (Python 3.11, uv installs it). Node 26 via `.nvmrc`.

```bash
npm run setup          # npm install + uv sync
npm run dev:api        # FastAPI on :8100 (API_PORT overrides; /docs for OpenAPI UI)
npm run dev            # Vite on :5173, proxies /api → :8100 (same API_PORT env)
npm run check          # what CI runs: oxlint, ruff check, ruff format --check, pytest, web build
npm test               # pytest only

# single test (from apps/api)
cd apps/api && uv run pytest tests/test_api.py -k health -q
cd apps/api && uv run ruff format .          # fix formatting (CI checks it)

npm run gen:api                  # regenerate contracts/openapi.json after changing API models
scripts/aikido_release_gate.sh   # release gate (Docker aikidosecurity/local-scanner, needs AIKIDO_API_KEY)
```

Port 8000 is often taken on dev machines, which is why the API defaults to 8100.

## Architecture

**Backend** (`apps/api/trainscanner/`): `main.py` only wires routers; endpoints live in `routes/`. Pydantic models
(once added in `models.py`) are the source of truth, mirrored by hand in `apps/web/src/api/types.ts`
(openapi-typescript is not used because it conflicts with TypeScript 7) and exported to `contracts/openapi.json`.
Change all three in the same PR.

**Config**: `config.py` resolves every path from its own file (works from any cwd). `Settings` (pydantic-settings)
loads the **repo-root `.env`**. Tests use an autouse fixture in `tests/conftest.py` that blanks Stripe secrets and
`offline_demo`; keep new settings-dependent tests behind it so they never hit real APIs.

**Stripe**: secret key and webhook secret are backend-only settings. The browser only gets
`VITE_STRIPE_PUBLISHABLE_KEY`; Vite reads the repo-root `.env` (`envDir: '../..'` in `vite.config.ts`). Amounts are
integers in minor units; the frontend never computes prices. Webhooks must verify the signature with
`STRIPE_WEBHOOK_SECRET` (`stripe listen --forward-to localhost:8100/api/stripe/webhook` locally).

**Frontend** (`apps/web/src/`): React 19 + Vite + Tailwind v4. `api/client.ts` wraps every API call.

## Conventions

- One branch + PR per GitHub issue, `Closes #N` in the PR, CI (`api`, `web`, `claude-review`) green before merge.
  Third-party GitHub Actions are pinned to commit SHAs (Aikido flags tags).
- The Aikido gate always reports as branch `main`: Aikido binds the repo to the branch of its first scan. `.env` is
  excluded from the scan, and `--no-snippets` keeps code local.
