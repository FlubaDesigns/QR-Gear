#!/bin/bash
# Step 1 of 3 — Bump BUILD_ID and compile both targets
# Bash tool timeout: 90000ms
set -e

sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)-$RANDOM'/" functions/src/index.ts
echo "[deploy/1-build] BUILD_ID bumped: $(grep _BUILD_ID functions/src/index.ts | head -1)"

echo "[deploy/1-build] Building frontend..."
npm run build 2>&1 | tail -5

echo "[deploy/1-build] Building functions..."
cd functions && npm run build 2>&1 | tail -3 && cd ..

echo "[deploy/1-build] Done. Run deploy/2-functions.sh next, then deploy/3-hosting.sh, then deploy/4-verify-functions.sh."
