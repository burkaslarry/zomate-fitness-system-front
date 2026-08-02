#!/usr/bin/env bash
# Reads .vercel/project.json and writes GitHub Actions secrets for Vercel deploy.
# Run locally after `vercel link` (requires `gh` CLI authenticated to this repo).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_JSON="$ROOT/.vercel/project.json"

if [[ ! -f "$PROJECT_JSON" ]]; then
  echo "Missing $PROJECT_JSON"
  echo "Run: vercel link"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required"
  exit 1
fi

ORG_ID="$(jq -r '.orgId // empty' "$PROJECT_JSON")"
PROJECT_ID="$(jq -r '.projectId // empty' "$PROJECT_JSON")"

if [[ -z "$ORG_ID" || -z "$PROJECT_ID" ]]; then
  echo "Invalid $PROJECT_JSON — expected orgId and projectId"
  exit 1
fi

echo "From $PROJECT_JSON:"
echo "  VERCEL_ORG_ID=$ORG_ID"
echo "  VERCEL_PROJECT_ID=$PROJECT_ID"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  read -rsp "VERCEL_TOKEN (https://vercel.com/account/tokens): " VERCEL_TOKEN
  echo
fi

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "VERCEL_TOKEN is required"
  exit 1
fi

gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
gh secret set VERCEL_ORG_ID --body "$ORG_ID"
gh secret set VERCEL_PROJECT_ID --body "$PROJECT_ID"

echo "GitHub secrets updated: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID"
