#!/usr/bin/env bash
# Resolve GitHub token for checking out an external client repo.
# Order: Payload /api/ci/github-token (tenant credential) → EXTERNAL_REPO_GITHUB_TOKEN → GITHUB_TOKEN → github.token
set -euo pipefail

TENANT="${TENANT:-}"
TOKEN=""

if [ -n "${PAYLOAD_URL:-}" ] && [ -n "${DEPLOY_REPORT_TOKEN:-}" ] && [ -n "$TENANT" ]; then
  BASE="${PAYLOAD_URL%/}"
  RESP="$(curl -sf -H "x-deploy-report-token: ${DEPLOY_REPORT_TOKEN}" \
    "${BASE}/api/ci/github-token?tenant=${TENANT}" 2>/dev/null || true)"
  if [ -n "$RESP" ]; then
    TOKEN="$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(j.token&&j.ok?String(j.token):'')}catch{}})")"
  fi
fi

if [ -z "$TOKEN" ] && [ -n "${GH_FALLBACK_TOKEN:-}" ]; then
  TOKEN="$GH_FALLBACK_TOKEN"
fi

set_github_env() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_ENV:-}" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$GITHUB_ENV"
  else
    printf '%s=%s\n' "$key" "$value"
  fi
}

if [ -z "$TOKEN" ]; then
  set_github_env "CLIENT_GITHUB_TOKEN" ""
  echo "::warning::No client GitHub token resolved; checkout may fail for private external repos."
  exit 0
fi

# Workflow commands must go to step stdout — never append these to GITHUB_ENV.
echo "::add-mask::${TOKEN}"
set_github_env "CLIENT_GITHUB_TOKEN" "$TOKEN"
