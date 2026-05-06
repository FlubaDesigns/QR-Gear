#!/bin/bash
# Step 2 of 3 — Deploy Cloud Functions to Firebase
# Bash tool timeout: 90000ms
set -euo pipefail

LOG_FILE="/tmp/qrgear-functions-deploy.log"

echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json

GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
  npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tee "$LOG_FILE"

rm -f /tmp/sa-key.json

if ! grep -q "functions source uploaded successfully" "$LOG_FILE"; then
  echo "[deploy/2-functions] ERROR: Firebase did not confirm functions source upload."
  exit 1
fi

if ! grep -q "Successful update operation" "$LOG_FILE"; then
  echo "[deploy/2-functions] ERROR: Firebase did not confirm successful function update."
  exit 1
fi

if ! grep -q "Deploy complete" "$LOG_FILE"; then
  echo "[deploy/2-functions] ERROR: Firebase did not confirm deploy complete."
  exit 1
fi

echo "[deploy/2-functions] VERIFIED: Cloud Functions deployed successfully."
echo "[deploy/2-functions] Done. Run deploy/3-hosting.sh next, then deploy/4-verify-functions.sh."
