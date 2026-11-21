#!/usr/bin/env bash
# 15:45 release gate (pre-freeze). Aikido Local Scanner runs ON THIS MACHINE: source code never leaves it
# (--no-snippets: no code snippets shared either; only findings metadata goes to Aikido).
# Docs: https://help.aikido.dev/code-scanning/local-code-scanning/cli-options-for-local-scanner
#
# Needs AIKIDO_API_KEY in .env (token from app.aikido.dev → Settings → Integrations → Local scan,
# shown only once). Uses the official Docker image by default; set AIKIDO_LOCAL_SCANNER_BIN to use
# a downloaded binary instead. AIKIDO_FAIL_ON = low|medium|high|critical (default: high).
# CI (.github/workflows/ci.yml) runs it on every push to main (release gating) and on every PR
# (PR gating: only NEW issues introduced by the branch fail; set AIKIDO_BASE_COMMIT + AIKIDO_HEAD_COMMIT).
set -euo pipefail
cd "$(dirname "$0")/.."
# Pinned by digest (supply chain): bump with `docker pull aikidosecurity/local-scanner` + `docker image inspect`.
IMAGE="aikidosecurity/local-scanner@sha256:181f14edc6de510ddf110c0f49f82626c1833a77191be98e7182a4e620466b68"
if [[ -f .env ]]; then set -a; source .env; set +a; fi
mkdir -p reports
rm -f reports/aikido_gate.json reports/aikido_local.txt
status=0

echo "▶ Frontend secret check (apps/web/src, built bundle)"
if grep -rInE '((sk|rk)_(test|live)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|AIK_CI_[A-Za-z0-9]+|(STRIPE_SECRET|AIKIDO_API)_KEY\s*=\s*\S+)' apps/web/src apps/web/dist 2>/dev/null; then
  echo "✖ Possible secret in frontend code"; status=1
else
  echo "✔ No secrets found in frontend"
fi

echo "▶ .env not tracked"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then echo "✖ .env is tracked!"; status=1; else echo "✔ ok"; fi

echo "▶ Aikido Local Scanner (SAST, dependencies, IaC, secrets)"
if [[ -z "${AIKIDO_API_KEY:-}" ]]; then
  echo "✖ AIKIDO_API_KEY not set in .env — Aikido scan NOT run"; status=1
else
  # Release gating always reports as the release branch: Aikido ties the repo to ONE default branch
  # and refuses other names in release mode (feature branches would need --gating-mode pr).
  args=(scan --apikey "$AIKIDO_API_KEY" --repositoryname train-scanner --branchname "${AIKIDO_BRANCH:-main}"
        --fail-on "${AIKIDO_FAIL_ON:-high}" --no-snippets
        --exclude node_modules --exclude apps/api/.venv --exclude apps/web/dist
        --exclude .env --exclude .data --exclude reports)
  if [[ -n "${AIKIDO_BASE_COMMIT:-}" ]]; then
    args+=(--gating-mode pr --base-commit-id "$AIKIDO_BASE_COMMIT" --head-commit-id "${AIKIDO_HEAD_COMMIT:?}")
  fi
  if [[ -n "${AIKIDO_LOCAL_SCANNER_BIN:-}" ]]; then
    "$AIKIDO_LOCAL_SCANNER_BIN" "${args[@]}" --gating-result-output reports/aikido_gate.json \
      --tmpdirectory "${TMPDIR:-/tmp}/aikidotmp" . 2>&1 | tee reports/aikido_local.txt || status=1
  else
    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/repo" -v "$PWD/reports:/reports" "${AIKIDO_IMAGE:-$IMAGE}" \
      "${args[@]}" --gating-result-output /reports/aikido_gate.json --tmpdirectory /tmp/aikidotmp /repo \
      2>&1 | tee reports/aikido_local.txt || status=1
  fi
fi

if [[ $status -eq 0 ]]; then echo "✅ RELEASE GATE PASS"; else echo "❌ RELEASE GATE FAIL"; fi
exit $status
