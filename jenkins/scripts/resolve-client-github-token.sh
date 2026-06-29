#!/usr/bin/env bash
# Resolve GitHub token for checking out an external client repo.
# Order: Payload /api/ci/github-token (tenant credential) → EXTERNAL_REPO_GITHUB_TOKEN → GITHUB_TOKEN
set -euo pipefail

TENANT="${TENANT:-${tenant_slug:-}}"
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

if [ -z "$TOKEN" ] && [ -n "${EXTERNAL_REPO_GITHUB_TOKEN:-}" ]; then
  TOKEN="$EXTERNAL_REPO_GITHUB_TOKEN"
fi

if [ -z "$TOKEN" ]; then
  echo "WARNING: No client GitHub token resolved; checkout may fail for private external repos." >&2
  exit 0
fi

export CLIENT_GITHUB_TOKEN="$TOKEN"
echo "Client GitHub token resolved (length ${#TOKEN})"
