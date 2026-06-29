#!/usr/bin/env bash
# Resolve GitHub token for checking out an external client repo.
# Order: Payload /api/ci/github-token (tenant credential) → EXTERNAL_REPO_GITHUB_TOKEN → GITHUB_TOKEN
set -euo pipefail

TENANT="${TENANT:-${tenant_slug:-}}"
TOKEN=""
TOKEN_SOURCE=""

if [ -z "$TENANT" ]; then
  echo "WARNING: tenant_slug/TENANT not set — cannot fetch per-tenant token from Payload." >&2
fi

if [ -n "${PAYLOAD_URL:-}" ] && [ -n "${DEPLOY_REPORT_TOKEN:-}" ] && [ -n "$TENANT" ]; then
  BASE="${PAYLOAD_URL%/}"
  RESP="$(curl -sS -H "x-deploy-report-token: ${DEPLOY_REPORT_TOKEN}" \
    "${BASE}/api/ci/github-token?tenant=${TENANT}" 2>/dev/null || true)"
  if [ -n "$RESP" ]; then
    TOKEN="$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);if(j.ok&&j.token)process.stdout.write(String(j.token));else if(j.message)console.error('[resolve-token] '+j.message)}catch{}})")"
    TOKEN_SOURCE="$(printf '%s' "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);if(j.ok&&j.source)process.stdout.write(String(j.source))}catch{}})")"
    TOKEN_SOURCE="${TOKEN_SOURCE:-payload-api}"
  else
    echo "WARNING: Payload /api/ci/github-token returned empty (check PAYLOAD_URL and DEPLOY_REPORT_TOKEN)." >&2
  fi
fi

if [ -z "$TOKEN" ] && [ -n "${GH_FALLBACK_TOKEN:-}" ]; then
  TOKEN="$GH_FALLBACK_TOKEN"
  TOKEN_SOURCE="gh-fallback-env"
fi

if [ -z "$TOKEN" ] && [ -n "${EXTERNAL_REPO_GITHUB_TOKEN:-}" ]; then
  TOKEN="$EXTERNAL_REPO_GITHUB_TOKEN"
  TOKEN_SOURCE="external-repo-github-token"
  echo "WARNING: Using Jenkins EXTERNAL_REPO_GITHUB_TOKEN — not the tenant credential from Payload." >&2
  echo "         Set tenant_slug to the Payload tenant slug (not the GitHub repo name)." >&2
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: No GitHub token resolved. Link a credential on the tenant in Payload, or set EXTERNAL_REPO_GITHUB_TOKEN." >&2
  exit 1
fi

export CLIENT_GITHUB_TOKEN="$TOKEN"
export CLIENT_GITHUB_TOKEN_SOURCE="$TOKEN_SOURCE"
echo "Client GitHub token resolved (source=${TOKEN_SOURCE}, length ${#TOKEN}, tenant=${TENANT:-<unset>})"
