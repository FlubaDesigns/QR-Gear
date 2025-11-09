#!/bin/bash
# push_main.sh — Push to main branch (use sparingly)

set -e
source ./pushlib.sh

git checkout main 2>/dev/null || git checkout -b main
commit_if_changed "auto: push from Replit $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

echo "OK: pushed to main"
