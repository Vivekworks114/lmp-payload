#!/usr/bin/env bash
set -euo pipefail

TENANT="${tenant_slug:-${TENANT:-}}"
GITHUB_REPO="${github_repo:-}"
GITHUB_BRANCH="${github_branch:-main}"
BLOG_PATH="${blog_content_path:-src/content/blog}"

export TENANT GITHUB_REPO GITHUB_BRANCH
export GH_FALLBACK_TOKEN="${EXTERNAL_REPO_GITHUB_TOKEN:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
cd "$WORKSPACE"

bash "$SCRIPT_DIR/checkout-platform.sh"
bash "$SCRIPT_DIR/resolve-client-github-token.sh"
bash "$SCRIPT_DIR/checkout-client-repo.sh"

cd "$WORKSPACE/platform"
corepack enable 2>/dev/null || true
pnpm install --frozen-lockfile

pnpm --filter @astropayload/payload import:blog-from-repo-api -- \
  --slug "$TENANT" \
  --site "$WORKSPACE/site" \
  --blog-path "$BLOG_PATH"

echo "Import complete for $TENANT"
