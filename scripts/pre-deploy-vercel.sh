#!/usr/bin/env bash
# [F015][S006]
# Feature: Admin Chrome / Frontend Ops
# Step: SRAA pre-deploy gate — Security Risk Assessment before Vercel production
# Logic: npm audit fix → fail on high/critical → production build must pass.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> [SRAA] npm audit fix (safe fixes only; never --force)"
npm audit fix

echo "==> [SRAA] npm audit gate (block high / critical)"
npm audit --audit-level=high

echo "==> [SRAA] production build"
npm run build

echo "==> [SRAA] Gate passed. Safe to deploy: vercel --prod"
