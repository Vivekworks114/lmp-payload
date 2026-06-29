#!/usr/bin/env bash
# Checkout astropayload platform repo into ./platform
set -euo pipefail

PLATFORM_DIR="${PLATFORM_DIR:-platform}"
PLATFORM_GIT_URL="${PLATFORM_GIT_URL:-}"
PLATFORM_GIT_BRANCH="${PLATFORM_GIT_BRANCH:-main}"
PLATFORM_GIT_TOKEN="${PLATFORM_GIT_TOKEN:-${GITHUB_TOKEN:-}}"

if [ -z "$PLATFORM_GIT_URL" ]; then
  OWNER="${GITHUB_OWNER:-}"
  REPO="${GITHUB_REPO:-astropayload}"
  if [ -z "$OWNER" ]; then
    echo "Set PLATFORM_GIT_URL or GITHUB_OWNER + GITHUB_REPO" >&2
    exit 1
  fi
  PLATFORM_GIT_URL="https://github.com/${OWNER}/${REPO}.git"
fi

rm -rf "$PLATFORM_DIR"
mkdir -p "$PLATFORM_DIR"

if [ -n "$PLATFORM_GIT_TOKEN" ]; then
  AUTH_URL="$(echo "$PLATFORM_GIT_URL" | sed -E "s#https://#https://x-access-token:${PLATFORM_GIT_TOKEN}@#")"
  git clone --depth 1 --branch "$PLATFORM_GIT_BRANCH" "$AUTH_URL" "$PLATFORM_DIR"
else
  git clone --depth 1 --branch "$PLATFORM_GIT_BRANCH" "$PLATFORM_GIT_URL" "$PLATFORM_DIR"
fi

echo "Platform checked out at $PLATFORM_DIR (branch $PLATFORM_GIT_BRANCH)"
