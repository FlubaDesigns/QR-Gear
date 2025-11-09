#!/bin/bash
# push_dev.sh — Push to dev branch

set -e
source ./pushlib.sh

git checkout dev 2>/dev/null || git checkout -b dev
commit_if_changed "auto: push from Replit $(date '+%Y-%m-%d %H:%M:%S')"
git push origin dev

echo "OK: pushed to dev"
