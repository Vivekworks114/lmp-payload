#!/usr/bin/env bash
# Tenant deploy — mirrors .github/workflows/tenant-deploy.yml
set -euo pipefail

TENANT="${tenant_slug:-${TENANT:-}}"
DEPLOY_MODE="${deploy_mode:-monorepo}"
GITHUB_REPO="${github_repo:-}"
GITHUB_BRANCH="${github_branch:-main}"
BLOG_CONTENT_PATH="${blog_content_path:-src/content/blog}"
RUN_URL="${BUILD_URL:-}"
PAYLOAD_URL="${PAYLOAD_URL:-}"
DEPLOY_REPORT_TOKEN="${DEPLOY_REPORT_TOKEN:-}"
CLOUDFLARE_WORKERS_DEV_SUBDOMAIN="${CLOUDFLARE_WORKERS_DEV_SUBDOMAIN:-}"

export TENANT DEPLOY_MODE GITHUB_REPO GITHUB_BRANCH BLOG_CONTENT_PATH

if [ -z "$TENANT" ]; then
  echo "tenant_slug parameter is required" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
cd "$WORKSPACE"

bash "$SCRIPT_DIR/checkout-platform.sh"
PLATFORM="$WORKSPACE/platform"
cd "$PLATFORM"

corepack enable 2>/dev/null || true
pnpm install --frozen-lockfile

if [ "$DEPLOY_MODE" = "external" ] && [ -n "$GITHUB_REPO" ]; then
  export GH_FALLBACK_TOKEN="${EXTERNAL_REPO_GITHUB_TOKEN:-}"
  bash "$SCRIPT_DIR/resolve-client-github-token.sh"
  bash "$SCRIPT_DIR/checkout-client-repo.sh"
  SITE_ROOT="$WORKSPACE/site"
else
  SITE_ROOT="$PLATFORM/apps/sites/$TENANT"
fi

if [ -n "$PAYLOAD_URL" ] && [ -n "$DEPLOY_REPORT_TOKEN" ]; then
  pnpm --filter @astropayload/payload auto-import-blog-if-empty -- \
    --slug "$TENANT" \
    --site "$SITE_ROOT" \
    --blog-path "$BLOG_CONTENT_PATH" || true
fi

if [ -n "$PAYLOAD_URL" ] && [ -n "$DEPLOY_REPORT_TOKEN" ] && [ -n "$RUN_URL" ]; then
  pnpm --filter @astropayload/payload report:deploy -- \
    --slug "$TENANT" \
    --status in_progress \
    --run-url "$RUN_URL" || true
fi

WORKERS_URL=""

if [ "$DEPLOY_MODE" = "external" ]; then
  cd "$PLATFORM"
  pnpm tenant-cli sync --slug "$TENANT" --site "$SITE_ROOT" --blog-path "$BLOG_CONTENT_PATH"

  cd "$SITE_ROOT"
  if [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile
    PKG=pnpm
  elif [ -f package-lock.json ]; then
    npm ci
    PKG=npm
  else
    npm install
    PKG=npm
  fi

  export TENANT
  if [ "$PKG" = "pnpm" ]; then pnpm run build; else npm run build; fi

  if [ "$PKG" = "pnpm" ]; then
    pnpm exec wrangler deploy 2>&1 | tee deploy.log || pnpm add -D wrangler@^4.84.0 && pnpm exec wrangler deploy 2>&1 | tee deploy.log
  else
    npx wrangler deploy 2>&1 | tee deploy.log
  fi
  WORKERS_URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' deploy.log | tail -1 || true)"
else
  if [ ! -d "$PLATFORM/apps/sites/$TENANT" ]; then
    echo "No monorepo site at apps/sites/$TENANT" >&2
    exit 1
  fi
  FILTER="@astropayload/site-${TENANT}"
  cd "$PLATFORM"
  pnpm --filter "$FILTER" sync:content
  pnpm --filter "$FILTER" build
  pnpm --filter "$FILTER" deploy 2>&1 | tee deploy.log
  WORKERS_URL="$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' deploy.log | tail -1 || true)"
fi

if [ -n "$PAYLOAD_URL" ] && [ -n "$DEPLOY_REPORT_TOKEN" ]; then
  cd "$PLATFORM"
  pnpm --filter @astropayload/payload report:deploy -- \
    --slug "$TENANT" \
    --status success \
    --workers-url "$WORKERS_URL" \
    --run-url "$RUN_URL" || true
fi

echo "Deploy complete for $TENANT"
