#!/usr/bin/env bash
set -euo pipefail

echo "== Typecheck =="
npm run typecheck

echo "== Build =="
rm -rf dist
npm run build >/dev/null

echo "== Scan dist for real server secrets =="

# Nur echte Server-Secrets prüfen (KEINE access_token Feldnamen!)
if rg -n -S "SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET|process\.env|postgresql:\/\/|postgres:\/\/" dist; then
  echo "ERROR: Found server-side secret references in dist/"
  exit 1
fi

echo "== Scan src for dangerous token logging =="

# Nur problematische Token-Manipulation im Source
if rg -n -S "access_token.*slice|refresh_token.*slice|provider_token.*slice" src; then
  echo "ERROR: Found token slicing/logging in src/"
  exit 1
fi

echo "== Scan repo for dangerous VITE_* names =="

if rg -n -S "VITE_.*(SERVICE|SECRET|DATABASE)" .; then
  echo "WARNING: Suspicious VITE_* env name detected. Verify manually."
fi

echo "OK: security audit passed"
