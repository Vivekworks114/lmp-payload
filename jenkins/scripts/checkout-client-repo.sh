#!/usr/bin/env bash
# Checkout external client site repo into ./site (after resolve-client-github-token.sh)
set -euo pipefail

SITE_DIR="${SITE_DIR:-site}"
GITHUB_REPO="${GITHUB_REPO:-${github_repo:-}}"
GITHUB_BRANCH="${GITHUB_BRANCH:-${github_branch:-main}}"

if [ -z "$GITHUB_REPO" ]; then
  echo "GITHUB_REPO is required for external deploy" >&2
  exit 1
fi

TOKEN="${CLIENT_GITHUB_TOKEN:-${EXTERNAL_REPO_GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "No CLIENT_GITHUB_TOKEN — run resolve-client-github-token.sh first" >&2
  exit 1
fi

rm -rf "$SITE_DIR"
git clone --depth 1 --branch "$GITHUB_BRANCH" \
  "https://x-access-token:${TOKEN}@github.com/${GITHUB_REPO}.git" \
  "$SITE_DIR"

echo "Client repo checked out at $SITE_DIR ($GITHUB_REPO @ $GITHUB_BRANCH)"
