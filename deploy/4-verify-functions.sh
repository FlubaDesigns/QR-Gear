#!/bin/bash
# Step 4 — Verify live Cloud Functions match the current BUILD_ID
set -euo pipefail

EXPECTED_BUILD_ID="$(grep "const _BUILD_ID" functions/src/index.ts | head -1 | sed -E "s/.*'([^']+)'.*/\1/")"

echo "[verify-functions] Expected BUILD_ID: $EXPECTED_BUILD_ID"

RESPONSE="$(curl -sS https://qrgear-c1ffd.web.app/api/deploy-proof)"

echo "$RESPONSE"

if ! echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "[verify-functions] ERROR: deploy-proof endpoint did not return ok:true"
  exit 1
fi

if ! echo "$RESPONSE" | grep -q "$EXPECTED_BUILD_ID"; then
  echo "[verify-functions] ERROR: Live Cloud Function BUILD_ID does not match local BUILD_ID."
  echo "[verify-functions] This means Cloud Functions were NOT actually updated."
  exit 1
fi

echo "[verify-functions] VERIFIED: Live Cloud Function matches current BUILD_ID."
