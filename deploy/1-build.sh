#!/bin/bash
# Step 1 of 3 — Bump BUILD_ID + functions version and compile both targets
# Bash tool timeout: 90000ms
set -e

# Bump _BUILD_ID in index.ts
sed -i "s/const _BUILD_ID = '[^']*'/const _BUILD_ID = '$(date +%Y%m%d-%H%M%S)-$RANDOM'/" functions/src/index.ts
echo "[deploy/1-build] BUILD_ID bumped: $(grep _BUILD_ID functions/src/index.ts | head -1)"

# Bump patch version in functions/package.json (required for Firebase to detect changes)
OLD_VER=$(node -p "require('./functions/package.json').version")
NEW_VER=$(echo "$OLD_VER" | awk -F. '{print $1"."$2"."$3+1}')
sed -i "s/\"version\": \"$OLD_VER\"/\"version\": \"$NEW_VER\"/" functions/package.json
echo "[deploy/1-build] functions/package.json version bumped: $OLD_VER → $NEW_VER"

echo "[deploy/1-build] Building frontend..."
npm run build 2>&1 | tail -5

echo "[deploy/1-build] Building functions..."
cd functions && npm run build 2>&1 | tail -3 && cd ..

echo "[deploy/1-build] Done. Run deploy/2-functions.sh next."
