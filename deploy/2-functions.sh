#!/bin/bash
# Step 2 of 3 — Deploy Cloud Functions to Firebase
# Bash tool timeout: 90000ms
set -e

echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
  npx firebase deploy --only functions --project qrgear-c1ffd --force 2>&1 | tail -10
rm -f /tmp/sa-key.json

echo "[deploy/2-functions] Done. Run deploy/3-hosting.sh next."
