#!/bin/bash
# Step 3 of 3 — Deploy frontend to Firebase Hosting
# Bash tool timeout: 60000ms
set -e

echo "$FIREBASE_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.json
GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json \
  npx firebase deploy --only hosting --project qrgear-c1ffd --force 2>&1 | tail -8
rm -f /tmp/sa-key.json

echo "[deploy/3-hosting] Deploy complete. Live at https://qrgear-c1ffd.web.app"
